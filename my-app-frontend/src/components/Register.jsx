import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import EstablishmentRegister from './EstablishmentRegister';
import { BASE, fetchJsonRetry } from '../api/api';
import { pwChecks, pwValid, pwStrength } from '../utils/password';
import { SECURITY_QUESTIONS } from '../utils/securityQuestions';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secQuestion, setSecQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [secAnswer, setSecAnswer] = useState('');
  const [role, setRole] = useState('tourist'); // 'tourist' | 'establishment'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address (used for password recovery).');
      return;
    }
    if (!pwValid(password)) {
      setError('Password does not meet the security requirements below.');
      return;
    }
    if (!secAnswer.trim()) {
      setError('Please answer your security question (for password recovery).');
      return;
    }

    try {
      const { res, data } = await fetchJsonRetry(`${BASE}/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // tourist self sign-up
        body: JSON.stringify({ username, email, password, role: 'tourist', security_question: secQuestion, security_answer: secAnswer }),
      });

      if (res.ok) {
        setSuccess('Registered! Redirecting to login...');
        setUsername('');
        setEmail('');
        setPassword('');
        setTimeout(() => navigate('/login'), 1200);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Could not connect to server');
    }
  };

  // Establishments get the full DOT-style accreditation registration form.
  if (role === 'establishment') {
    return <EstablishmentRegister onSwitchToTourist={() => setRole('tourist')} />;
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7v2h20V7L12 2zM4 10v9h2v-9H4zm14 0v9h2v-9h-2zm-9 0v9h2v-9H9zm5 0v9h2v-9h-2zM2 21v2h20v-2H2z"/></svg>
        </div>
        <h1>Be@Mandaluyong</h1>
        <p>{role === 'establishment' ? 'Register your establishment for accreditation' : 'Create your tourist account'}</p>
      </div>

      <div className="auth-card">
        <form onSubmit={handleSubmit} autoComplete="off" className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <div className="form-group">
            <label>I am registering as</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setRole('tourist')}
                style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                         border: role === 'tourist' ? '2px solid #1D4ED8' : '1px solid #d1d5db',
                         background: role === 'tourist' ? '#eff6ff' : '#fff', color: role === 'tourist' ? '#1D4ED8' : '#374151' }}
              > Tourist</button>
              <button
                type="button"
                onClick={() => setRole('establishment')}
                style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                         border: role === 'establishment' ? '2px solid #1D4ED8' : '1px solid #d1d5db',
                         background: role === 'establishment' ? '#EFF5FF' : '#fff', color: role === 'establishment' ? '#1D4ED8' : '#374151' }}
              > Establishment</button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 110-8 4 4 0 010 8z"/></svg>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com — for password recovery"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24"><path d="M12 17a2 2 0 002-2 2 2 0 00-2-2 2 2 0 00-2 2 2 2 0 002 2zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 0110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/></svg>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {password && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: pwStrength(password).pct + "%", background: pwStrength(password).color, transition: "width .2s ease" }} />
                </div>
                {pwStrength(password).label && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: pwStrength(password).color, marginBottom: 8 }}>
                    {pwStrength(password).label} password
                  </div>
                )}
                {pwChecks(password).map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.ok ? "#16a34a" : "#9ca3af", marginBottom: 4 }}>
                    <span style={{ width: 14, textAlign: "center", fontWeight: 700 }}>{c.ok ? "✓" : "•"}</span>{c.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-secq">Security Question <span style={{ color: '#6b7280', fontWeight: 400 }}>(for password recovery)</span></label>
            <select id="reg-secq" value={secQuestion} onChange={(e) => setSecQuestion(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
              {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input type="text" value={secAnswer} onChange={(e) => setSecAnswer(e.target.value)} placeholder="Your answer"
              autoComplete="off"
              style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', marginTop: 8 }} />
            <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '6px 0 0' }}>Remember this — you'll use it if you forget your password.</p>
          </div>

          <button type="submit" className="btn-primary" disabled={!pwValid(password) || !secAnswer.trim()} style={(!pwValid(password) || !secAnswer.trim()) ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>Create account</button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;