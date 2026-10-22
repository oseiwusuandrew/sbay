import { HttpError } from './httpError.js';

/**
 * One password rule for sign-up, reset and change, following current
 * guidance (NIST SP 800-63B): length matters, composition rules don't.
 * No "must contain a symbol"; instead the most guessed passwords and
 * passwords built from the account's own email or name are refused.
 */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '11111111', '00000000',
  '12341234', '11223344', '12121212', '88888888', '99999999', '123123123', '1q2w3e4r',
  'qwertyui', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'asdfasdf', 'zxcvbnm1', '1qaz2wsx',
  'abc12345', 'abcd1234', 'abcdefgh', 'iloveyou', 'iloveyou1', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'trustno1', 'welcome1', 'welcome123', 'letmein1',
  'starwars', 'whatever', 'computer', 'internet', 'changeme', 'default1', 'admin123',
  'administrator', 'jesus123', 'godisgood', 'blessing', 'ghana123', 'ghana1234',
  'accra123', 'kumasi123', 'student1', 'student123', 'sbay1234', 'sbay12345',
]);

/** Why a password is not acceptable, or null when it is fine. */
export function passwordProblem(password, { email = '', name = '' } = {}) {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw)) return 'That password is too easy to guess. Try a short phrase instead.';
  const local = String(email).toLowerCase().split('@')[0];
  if (local.length >= 4 && lower.includes(local)) return "Don't use your email address in your password.";
  const first = String(name).toLowerCase().trim().split(/\s+/)[0] || '';
  if (first.length >= 4 && lower.replace(/\d+$/, '') === first) return "Don't use just your name as your password.";
  return null;
}

/** Throw a 400 with the reason when the password isn't acceptable. */
export function assertPassword(password, who) {
  const problem = passwordProblem(password, who);
  if (problem) throw new HttpError(400, problem);
}
