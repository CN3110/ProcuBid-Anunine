import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Login from "./Components/Auth/Login";
import AdminDashboard from "./Components/Admin/AdminDashboard";
import BidderDashboard from "./Components/Bidder/BidderDashboard";

// ✅ Role-based protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  // Not logged in → redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Role not allowed → redirect to login
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Access granted
  return children;
};

const App = () => {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <div className="app">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Admin route → only for admin */}
          <Route
            path="/admindashboard"
            element={
              <ProtectedRoute allowedRoles={["admin", "system_admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Bidder route → only for bidder */}
          <Route
            path="/bidderdashboard"
            element={
              <ProtectedRoute allowedRoles={["bidder"]}>
                <BidderDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
};

export default App;
