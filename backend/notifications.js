// Sends push notifications via Expo's free push service
// No Firebase, no Apple account needed — just works!

async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log('Invalid push token, skipping notification');
    return;
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to:    pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'bond-notifications',
      }),
    });
    const result = await res.json();
    if (result.data?.status === 'error') {
      console.log('Push notification error:', result.data.message);
    }
  } catch (err) {
    console.log('Failed to send notification:', err.message);
  }
}

// Get friend's push token from DB
async function getFriendToken(client, userId) {
  try {
    const userRes = await client.execute({
      sql:  'SELECT friend_id FROM users WHERE id = ?',
      args: [userId],
    });
    const user = userRes.rows[0];
    if (!user?.friend_id) return null;

    const friendRes = await client.execute({
      sql:  'SELECT push_token FROM users WHERE id = ?',
      args: [user.friend_id],
    });
    return friendRes.rows[0]?.push_token || null;
  } catch { return null; }
}

// Notify friend when you add a memory
async function notifyMemoryAdded(client, userId, memoryTitle) {
  const userRes = await client.execute({ sql: 'SELECT name FROM users WHERE id = ?', args: [userId] });
  const userName = userRes.rows[0]?.name || 'Your friend';
  const token = await getFriendToken(client, userId);
  if (token) {
    await sendPushNotification(token,
      '📸 New Memory Added!',
      `${userName} just added "${memoryTitle}" to your memories`,
      { type: 'memory' }
    );
  }
}

// Notify friend when you check in
async function notifyCheckIn(client, userId, mood) {
  const moodEmojis = { 1:'😔', 2:'😕', 3:'😐', 4:'🙂', 5:'😄' };
  const userRes = await client.execute({ sql: 'SELECT name FROM users WHERE id = ?', args: [userId] });
  const userName = userRes.rows[0]?.name || 'Your friend';
  const token = await getFriendToken(client, userId);
  if (token) {
    await sendPushNotification(token,
      `${moodEmojis[mood] || '💬'} ${userName} checked in!`,
      `${userName} is feeling ${['', 'really down', 'not great', 'okay', 'pretty good', 'amazing'][mood] || 'something'} today`,
      { type: 'checkin' }
    );
  }
}

// Notify friend when you complete a bucket item
async function notifyBucketComplete(client, userId, itemTitle) {
  const userRes = await client.execute({ sql: 'SELECT name FROM users WHERE id = ?', args: [userId] });
  const userName = userRes.rows[0]?.name || 'Your friend';
  const token = await getFriendToken(client, userId);
  if (token) {
    await sendPushNotification(token,
      '🎯 Bucket List Item Done!',
      `${userName} just completed "${itemTitle}"`,
      { type: 'bucket' }
    );
  }
}

// Notify friend when you update your profile photo
async function notifyProfileUpdate(client, userId) {
  const userRes = await client.execute({ sql: 'SELECT name FROM users WHERE id = ?', args: [userId] });
  const userName = userRes.rows[0]?.name || 'Your friend';
  const token = await getFriendToken(client, userId);
  if (token) {
    await sendPushNotification(token,
      '✨ Profile Updated',
      `${userName} just updated their profile photo`,
      { type: 'profile' }
    );
  }
}

module.exports = {
  sendPushNotification,
  notifyMemoryAdded,
  notifyCheckIn,
  notifyBucketComplete,
  notifyProfileUpdate,
};
