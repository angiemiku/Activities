const { appId, publicKey, botToken } = require('../config.json');
const nacl = require('tweetnacl');
const express = require('express');
const { fetch } = require('undici');
const app = express();


app.use(express.json({ verify: (req, res, buf) => req.rawBody = buf }));
function middlewareKey(req, res, next) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  if (!signature || !timestamp) return res.status(401).end();
  const isValid = nacl.sign.detached.verify(
    Buffer.concat([Buffer.from(timestamp, 'utf8'), req.rawBody]),
    Buffer.from(signature, 'hex'),
    Buffer.from(publicKey, 'hex')
  );
  if (!isValid) return res.status(401).end();
  next();
};

app.post('/interactions', middlewareKey, async (req, res) => { 
  const { type, data } = req.body;
  if (type === 1) return res.json({ type: 1 });
  
  if (type === 2) {
    if (data.name === "activity") {
      const channelId = data.options[0].value;
      const activityId = data.options[1].value;
      
      if (!data.resolved?.channels) return res.json({ type: 4, data: { content: 'Please update your Discord app to use this command.', flags: 64 } });
      
      if (data.resolved.channels[channelId].type !== 2) return res.json({ type: 4, data: { content: 'The selected channel must be a voice channel', flags: 64 } });
      
      const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/invites`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_age: 0,
          target_type: 2,
          target_application_id: activityId,
        }),
      });
      const invite = await r.json();

      if (!r.ok) return res.json({ type: 4, data: { content: `An error occured: ${invite.message}\nMake sure I have the "Create Invite" permission in the voice channel!`, flags: 64, allowed_mentions: { parse: [] } } });
      
      return res.json({ type: 4, data: { content: `[Click to start ${invite.target_application.name}](https://discord.gg/${invite.code})`, allowed_mentions: { parse: [] } } });
    }

    if (data.name === "ping") return res.json({ type: 4, data: { content: "🏓 Pong!" } });
    
  }
  
});


module.exports = app;
