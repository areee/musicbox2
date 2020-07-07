require('dotenv').config();
const Octokit = require("@octokit/rest");
const fetch = require("node-fetch");
const eaw = require('eastasianwidth');

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  LASTFM_KEY: lfmAPI,
  LFMUSERNAME: user
} = process.env

const octokit = new Octokit({
  auth: `token ${githubToken}`
});

const API_BASE = 'http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&format=json&period=7day&';

async function main() {
  const username = user
  const gistID = gistId;
  const lfm = lfmAPI;

  if (!lfm || !username || !gistID || !githubToken)
    throw new Error('Please check your environment variables, as you are missing one.')
  const API = `${API_BASE}user=${username}&api_key=${lfm}`

  const data = await fetch(API);
  const json = await data.json();

  let gist;
  try {
    gist = await octokit.gists.get({
      gist_id: gistID
    });
  } catch (error) {
    console.error(`music-box ran into an issue getting your Gist:\n${error}`);
  }

  const numArtist = Math.min(10, json.toptracks.track.length);
  let playsTotal = 0;
  for(let i = 0; i < numArtist; i++) {
    playsTotal += parseInt(json.toptracks.track[i].playcount, 10);
  }

  const lines = [];
  for(let i = 0; i < numArtist; i++) {
    const plays = json.toptracks.track[i].playcount;
    let name =  json.toptracks.track[i].name.substring(0, 25);
    // trim off long widechars
    for(let i = 24; i >= 0; i--) {
      if(eaw.length(name) <= 26) break;
      name = name.substring(0, i);
    }
    // pad short strings
    name = name.padEnd(23 + name.length - eaw.length(name));
    
    // 'plays' string in singular or plural form
    let playsStr = '';
    
    if (plays == 1) {
      playsStr = 'time';
    } else {
      playsStr = 'times';
    }
    
    lines.push([
      name,
      generateBarChart(plays * 100 / playsTotal, 17),
      `${plays}`.padStart(5),
      playsStr
    ].join(' '));
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    console.log(lines.join("\n"));
    await octokit.gists.update({
      gist_id: gistID,
      files: {
        [filename]: {
          filename: `🔊🎶 My last week in music (top tracks)`,
          content: lines.join("\n")
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [
    syms.substring(8, 9).repeat(barsFull),
    syms.substring(semi, semi + 1),
  ].join("").padEnd(size, syms.substring(0, 1));
}

async function updateGist() {
  let gist;
  try {
    gist = await octokit.gists.get({
      gist_id: gistID
    })
  } catch (error) {
    console.error(`music-box ran into an issue:\n${error}`);
  }
}

(async () => {
  await main();
})();
