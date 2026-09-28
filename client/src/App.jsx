import { useEffect, useRef, useState } from "react";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

const data =
    response.status === 204
      ? null
      : await response.json().catch(() => ({}));

if (!response.ok) {
    const error = new Error(data?.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

return data;
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Calorie home">
      <span className="brand-mark" aria-hidden="true">c.</span>
      <span>calorie<span className="brand-dot">.</span></span>
    </a>
  );
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

const form = new FormData(event.currentTarget);

try {
      const data = await api(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

onLogin(data.user);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE MORE AWARENESS</span>
          <h1>Small entries.<br />A clearer picture.</h1>
          <p>
            Your meals, your pace. A simple space to record what you eat
            and see your day at a glance.
          </p>
          <div className="story-card">
            <span className="story-symbol" aria-hidden="true">✳</span>
            <div>
              <strong>Make room for everyday progress.</strong>
              <p>No complicated spreadsheets. Just your food journal.</p>
            </div>
          </div>
        </div>
        <span className="auth-footer">Made for your everyday.</span>
      </section>

<section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR PERSONAL FOOD JOURNAL</span>
          <h2>{register ? "Start fresh." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Create an account to start tracking."
              : "Sign in and pick up where you left off."}
          </p>

<form onSubmit={submit} className="stack">
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  minLength={2}
                  maxLength={60}
                  required
                />
              </label>
            )}

<label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>

<label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "At least 8 characters" : "Your password"}
                minLength={register ? 8 : undefined}
                maxLength={72}
                required
              />
            </label>

{error && <p className="notice error" role="alert">{error}</p>}

<button className="button primary" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account →" : "Sign in →"}
            </button>
          </form>

<p className="switch-auth">
            {register ? "Already have an account?" : "New to Calorie?"}{" "}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ user, setUser, onLogout }) {
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState(user.goal);
  const [food, setFood] = useState({
    name: "",
    calories: "",
    meal: "Breakfast",
  });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const foodInput = useRef(null);

useEffect(() => {
    const controller = new AbortController();

setLoading(true);
    setLoadFailed(false);
    setError("");
    setNotice("");
    setEntries([]);

api(`/entries?date=${encodeURIComponent(date)}`, {
      signal: controller.signal,
    })
      .then((data) => setEntries(data.entries))
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          onLogout();
          return;
        }
        setLoadFailed(true);
        setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

return () => controller.abort();
  }, [date, reload, onLogout]);

const total = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const remaining = Math.max(user.goal - total, 0);
  const over = Math.max(total - user.goal, 0);
  const unavailable = loading || loadFailed;

async function perform(key, action, message) {
    setBusy(key);
    setError("");
    setNotice("");

try {
      await action();
      setNotice(message);
    } catch (error) {
      if (error.status === 401) onLogout();
      else setError(error.message);
    } finally {
      setBusy("");
    }
  }

function addFood(event) {
    event.preventDefault();

perform(
      "add",
      async () => {
        const data = await api("/entries", {
          method: "POST",
          body: JSON.stringify({
            name: food.name,
            calories: Number(food.calories),
            meal: food.meal,
            date,
          }),
        });

setEntries((current) => [data.entry, ...current]);
        setFood((current) => ({ ...current, name: "", calories: "" }));
        foodInput.current?.focus();
      },
      "Food added to your journal."
    );
  }

function saveGoal(event) {
    event.preventDefault();

perform(
      "goal",
      async () => {
        const data = await api("/users/goal", {
          method: "PATCH",
          body: JSON.stringify({ goal: Number(goal) }),
        });
        setUser(data.user);
      },
      "Daily goal updated."
    );
  }

function deleteEntry(id) {
    perform(
      id,
      async () => {
        await api(`/entries/${id}`, { method: "DELETE" });
        setEntries((current) => current.filter((entry) => entry._id !== id));
      },
      "Entry removed."
    );
  }

function logout() {
    perform(
      "logout",
      async () => {
        await api("/auth/logout", { method: "POST" });
        onLogout();
      },
      ""
    );
  }

return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-caption">YOUR WORKSPACE</div>
        <div className="nav-active"><span aria-hidden="true">▦</span> Daily journal</div>

<div className="sidebar-bottom">
          <div className="sidebar-note">
            <span aria-hidden="true">✳</span>
            <strong>One day at a time.</strong>
            <p>A little awareness goes a long way.</p>
          </div>

<div className="profile">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <button
                className="text-button"
                onClick={logout}
                disabled={Boolean(busy)}
              >
                {busy === "logout" ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </aside>

<main className="dashboard">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">YOUR DAILY OVERVIEW</span>
            <h1>Let’s check in, {user.name.split(" ")[0]}.</h1>
            <p className="muted">A simple snapshot of what’s on your plate.</p>
          </div>

<label className="date-control">
            Journal date
            <input
              type="date"
              value={date}
              disabled={Boolean(busy)}
              required
              onChange={(event) => {
                if (
                  /^\d{4}-\d{2}-\d{2}$/.test(event.target.value) &&
                  event.target.validity.valid
                ) {
                  setDate(event.target.value);
                }
              }}
            />
          </label>
        </header>

{error && (
          <div className="notice error" role="alert">
            {error}
            {loadFailed && (
              <button
                className="text-button retry"
                onClick={() => setReload((value) => value + 1)}
              >
                Retry loading
              </button>
            )}
          </div>
        )}

{notice && <div className="notice success" role="status">{notice}</div>}

<section className="stats-grid" aria-label="Daily calorie summary">
          <article className="stat-card featured">
            <span>Calories logged</span>
            <div className="stat-number">
              {unavailable ? "—" : formatNumber(total)} <small>kcal</small>
            </div>
            <span className="stat-caption">
              {unavailable ? "Waiting for journal data" : `${entries.length} food entries`}
            </span>
          </article>

<article className="stat-card">
            <span>Daily goal</span>
            <div className="stat-number">
              {formatNumber(user.goal)} <small>kcal</small>
            </div>
            <span className="stat-caption">Your personal setting</span>
          </article>

<article className="stat-card">
            <span>{over > 0 && !unavailable ? "Above goal" : "Remaining"}</span>
            <div className="stat-number">
              {unavailable ? "—" : formatNumber(over || remaining)} <small>kcal</small>
            </div>
            <span className="stat-caption">
              {unavailable ? "Waiting for journal data" : "Relative to your daily goal"}
            </span>
          </article>
        </section>

<section className="progress-card">
          <div className="section-heading">
            <div>
              <h2>Your daily balance</h2>
              <p className="muted">
                {unavailable
                  ? "Your progress will appear when the journal loads."
                  : `${formatNumber(total)} of ${formatNumber(user.goal)} kcal logged`}
              </p>
            </div>
            <span className="pill">
              {unavailable ? "—" : `${Math.round((total / user.goal) * 100)}%`}
            </span>
          </div>

<progress
            aria-label="Calories logged toward daily goal"
            max={user.goal}
            value={unavailable ? 0 : Math.min(total, user.goal)}
          />
        </section>

<div className="content-grid">
          <section className="card journal">
            <div className="section-heading">
              <div>
                <h2>Food journal</h2>
                <p className="muted">Everything you’ve logged for this date.</p>
              </div>
              <span className="pill neutral">
                {unavailable ? "—" : `${entries.length} entries`}
              </span>
            </div>

{loading ? (
              <p className="empty" role="status">Loading your journal…</p>
            ) : loadFailed ? (
              <p className="empty">Your journal could not be loaded. Please retry.</p>
            ) : entries.length === 0 ? (
              <div className="empty">
                <span className="empty-symbol" aria-hidden="true">＋</span>
                <h3>A fresh page for your day.</h3>
                <p>Add your first food to get started.</p>
                <button
                  className="button secondary"
                  onClick={() => foodInput.current?.focus()}
                >
                  Log your first food
                </button>
              </div>
            ) : (
              MEALS.map((meal) => {
                const foods = entries.filter((entry) => entry.meal === meal);
                if (!foods.length) return null;

const mealTotal = foods.reduce(
                  (sum, entry) => sum + entry.calories,
                  0
                );

return (
                  <section className="meal-group" key={meal}>
                    <div className="meal-heading">
                      <h3>{meal}</h3>
                      <span>{formatNumber(mealTotal)} kcal</span>
                    </div>

{foods.map((entry) => (
                      <div className="food-row" key={entry._id}>
                        <span className="food-marker" aria-hidden="true">•</span>
                        <div className="food-description">
                          <strong>{entry.name}</strong>
                          <span>{entry.meal}</span>
                        </div>
                        <span className="food-calories">
                          {formatNumber(entry.calories)} <small>kcal</small>
                        </span>
                        <button
                          className="delete-button"
                          aria-label={`Delete ${entry.name}`}
                          title={`Delete ${entry.name}`}
                          disabled={Boolean(busy)}
                          onClick={() => deleteEntry(entry._id)}
                        >
                          {busy === entry._id ? "…" : "×"}
                        </button>
                      </div>
                    ))}
                  </section>
                );
              })
            )}
          </section>

<div className="right-column">
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Log a food</h2>
                  <p className="muted">Keep it simple. Every entry counts.</p>
                </div>
                <span className="plus-badge" aria-hidden="true">＋</span>
              </div>

<form onSubmit={addFood} className="stack">
                <label>
                  Food name
                  <input
                    ref={foodInput}
                    placeholder="e.g. Oatmeal with banana"
                    value={food.name}
                    onChange={(event) =>
                      setFood({ ...food, name: event.target.value })
                    }
                    maxLength={100}
                    required
                  />
                </label>

<div className="form-row">
                  <label>
                    Calories (kcal)
                    <input
                      type="number"
                      placeholder="350"
                      value={food.calories}
                      onChange={(event) =>
                        setFood({ ...food, calories: event.target.value })
                      }
                      min={1}
                      max={20000}
                      step={1}
                      required
                    />
                  </label>

<label>
                    Meal
                    <select
                      value={food.meal}
                      onChange={(event) =>
                        setFood({ ...food, meal: event.target.value })
                      }
                    >
                      {MEALS.map((meal) => <option key={meal}>{meal}</option>)}
                    </select>
                  </label>
                </div>

<button
                  className="button primary"
                  disabled={Boolean(busy) || unavailable}
                >
                  {busy === "add" ? "Adding…" : "＋ Add to journal"}
                </button>

<p className="form-hint">
                  Enter calories for the full portion you ate.
                </p>
              </form>
            </section>

<section className="card goal-card">
              <h2>Make it your own</h2>
              <p className="muted">Set the daily calorie goal you want to track.</p>

<form onSubmit={saveGoal} className="goal-form">
                <label>
                  Daily goal (kcal)
                  <input
                    type="number"
                    value={goal}
                    min={1}
                    max={20000}
                    step={1}
                    required
                    onChange={(event) => setGoal(event.target.value)}
                  />
                </label>

<button className="button secondary" disabled={Boolean(busy)}>
                  {busy === "goal" ? "Saving…" : "Save"}
                </button>
              </form>

<p className="form-hint">
                Your goal applies to all journal dates. The starter value is
                editable and is not a personalized recommendation.
              </p>
            </section>
          </div>
        </div>

<footer className="dashboard-footer">
          Your journal, your pace. Calorie entries are manually recorded.
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");

// Stable callback prevents unnecessary journal refetches.
  const onLogout = useRef(() => setUser(null)).current;

useEffect(() => {
    const controller = new AbortController();

api("/auth/me", { signal: controller.signal })
      .then((data) => setUser(data.user))
      .catch((error) => {
        if (error.name !== "AbortError" && error.status !== 401) {
          setStartupError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

return () => controller.abort();
  }, []);

if (loading) {
    return <main className="loading-screen" role="status">Opening your journal…</main>;
  }

if (startupError) {
    return (
      <main className="loading-screen">
        <h1>Unable to connect</h1>
        <p role="alert">{startupError}</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  }

return user ? (
    <Dashboard user={user} setUser={setUser} onLogout={onLogout} />
  ) : (
    <Auth onLogin={setUser} />
  );
}
