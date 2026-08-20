import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PublicEvents from "./PublicEvents";

/*
  What the site root shows.

  Visitors (not signed in) land on the public events page — the city's
  events calendar is the thing an ordinary resident actually came for,
  and it needs no account. Previously "/" bounced straight to /login,
  which meant a tourist hitting the domain saw a staff login form and
  had no way to discover the public page at all.

  Anyone already signed in keeps their old behaviour and goes to their
  dashboard, so staff/admin workflows are unchanged.
*/
export default function LandingRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <PublicEvents />;
}
