/* The Claude connector's sign-in page (see index.html). Supabase Auth opens it
   with ?authorization_id=...: sign in with the app's login, then approve or
   deny, and Supabase hands back the address to return to Claude with. The
   sign-in lives only in this page's memory: nothing is saved in the browser. */
const SUPABASE_URL = 'https://gsauinadkzfwybvkooxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_P_FvGv6svaECHEwMT8f3MA_91kBbeul'; // public, as in the app (src/lib/config.ts)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const $ = id => document.getElementById(id);
const authId = new URLSearchParams(location.search).get('authorization_id');

function show(which) {
  for (const s of ['signin', 'consent', 'message']) $(s).hidden = s !== which;
}
function say(title, text) {
  $('message-title').textContent = title;
  $('message-text').textContent = text || '';
  show('message');
}
function goBack(url) {
  say('Going back to Claude…');
  location.replace(url);
}
const expired = err => say('This sign-in link has run out', 'Go back to Claude and press Connect again. (' + err.message + ')');

if (!authId) say('Nothing to approve here', 'This page opens by itself when you connect Nubbie Gainz in Claude, from Customize, then Connectors.');
else { show('signin'); $('email').focus(); }

$('signin').addEventListener('submit', async e => {
  e.preventDefault();
  $('signin-error').textContent = '';
  $('signin-go').disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) { $('signin-error').textContent = "That email and password didn't work. " + error.message; return; }
    $('password').value = '';
    const { data, error: err } = await sb.auth.oauth.getAuthorizationDetails(authId);
    if (err) return expired(err);
    // Approved before: Supabase goes straight back.
    if (!('authorization_id' in data)) return goBack(data.redirect_url);
    const host = new URL(data.redirect_uri).hostname;
    $('client').textContent = data.client?.name || 'An app';
    $('host').textContent = host;
    $('not-claude').hidden = /(^|\.)claude\.(ai|com)$/.test(host) || host === 'localhost' || host === '127.0.0.1';
    show('consent');
  } catch (err) {
    $('signin-error').textContent = 'Something went wrong: ' + (err?.message || err);
  } finally {
    $('signin-go').disabled = false;
  }
});

async function answer(approve) {
  $('approve').disabled = $('deny').disabled = true;
  $('consent-error').textContent = '';
  const fn = approve ? sb.auth.oauth.approveAuthorization : sb.auth.oauth.denyAuthorization;
  const { data, error } = await fn(authId, { skipBrowserRedirect: true });
  if (error) {
    $('consent-error').textContent = 'That didn\'t go through: ' + error.message;
    $('approve').disabled = $('deny').disabled = false;
    return;
  }
  goBack(data.redirect_url);
}
$('approve').addEventListener('click', () => answer(true));
$('deny').addEventListener('click', () => answer(false));
