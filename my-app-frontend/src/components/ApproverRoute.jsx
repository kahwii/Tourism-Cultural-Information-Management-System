import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isApprover } from "../utils/roles";

/*
  Guards the pages a CCAT Staff "maker" must not reach — account management
  and the audit trail. Hiding them from the sidebar isn't enough on its own,
  since a staff member could simply type the URL.

  This is still only a convenience layer: the binding rule lives server-side
  in require_approver() / crud.php.
*/
export default function ApproverRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isApprover(user.role)) return <Navigate to="/admin" replace />;
  return children;
}
