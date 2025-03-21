const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const QRCode = require('qrcode');
const app = express();
const port = 3000;

// Set EJS as the templating engine and specify the views folder
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// Serve static files from the "public" folder
app.use(express.static('public'));

// Global battle state: teams and votes
let teams = ["Team A", "Team B", "Team C", "Team D"];
let votes = {};
teams.forEach(team => votes[team] = 0);

// Root URL now serves the admin panel
app.get('/', (req, res) => {
  res.render('admin', { teams: teams, votes: votes });
});

// Dedicated voting page for users (vote.ejs) - accessible at /vote
app.get('/vote', (req, res) => {
  res.render('vote', { teams: teams });
});

// Handle vote submissions from the dedicated voting page
app.post('/vote', (req, res) => {
  if (req.cookies.voted) {
    return res.redirect('/vote?voted=' + encodeURIComponent(req.cookies.voted));
  }
  const team = req.body.team;
  if (votes.hasOwnProperty(team)) {
    votes[team]++;
    res.cookie('voted', team, { maxAge: 24 * 60 * 60 * 1000 });
  }
  res.redirect('/vote?voted=' + encodeURIComponent(team));
});

// Handle vote editing (if needed)
app.post('/edit-vote', (req, res) => {
  const oldVote = req.body.oldVote;
  const newVote = req.body.newVote;
  if (votes.hasOwnProperty(oldVote) && votes.hasOwnProperty(newVote)) {
    if (votes[oldVote] > 0) {
      votes[oldVote]--;
    }
    votes[newVote]++;
    res.cookie('voted', newVote, { maxAge: 24 * 60 * 60 * 1000 });
  }
  res.redirect('/vote?voted=' + encodeURIComponent(newVote));
});

// Results page – dynamically displays current vote counts
app.get('/results', (req, res) => {
  res.render('results', { votes: votes });
});

// JSON API for vote counts (for client-side polling)
app.get('/api/votes', (req, res) => {
  res.json(votes);
});

// Generate QR Code for the voting page
app.get('/qr', async (req, res) => {
  let url;
  if (process.env.RENDER_EXTERNAL_URL) {
    url = process.env.RENDER_EXTERNAL_URL + '/vote';
  } else if (process.env.NODE_ENV === 'production') {
    url = `https://${req.get('host')}/vote`;
  } else {
    url = `http://${req.hostname}:${port}/vote`;
  }
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url);
    res.render('qr', { qrCodeDataURL: qrCodeDataURL });
  } catch (err) {
    console.error(err);
    res.send('Error generating QR code');
  }
});

// Admin panel – view current teams/votes and update team names to start a new battle
app.get('/admin', (req, res) => {
  res.render('admin', { teams: teams, votes: votes });
});

// Admin action: Reset votes only
app.post('/admin/reset', (req, res) => {
  teams.forEach(team => votes[team] = 0);
  res.redirect('/admin');
});

// Admin action: Update team names (new battle) and reset votes
app.post('/admin/update', (req, res) => {
  let newTeams = [];
  // Iterate over all keys in req.body that start with "team"
  Object.keys(req.body).forEach(key => {
    if (key.startsWith("team")) {
      newTeams.push({ index: parseInt(key.replace("team", "")), name: req.body[key].trim() });
    }
  });
  // Sort by the numeric index, map to names, and filter out empty names
  newTeams = newTeams.sort((a, b) => a.index - b.index)
                       .map(obj => obj.name)
                       .filter(name => name !== "");
  if (newTeams.length === 0) {
    // Fallback to defaults if none provided
    newTeams = ["Team A", "Team B", "Team C", "Team D"];
  }
  teams = newTeams;
  votes = {};
  teams.forEach(team => votes[team] = 0);
  res.redirect('/admin');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
