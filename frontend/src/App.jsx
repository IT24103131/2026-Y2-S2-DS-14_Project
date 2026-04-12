import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login              from "./pages/Login";
import Register           from "./pages/Register";
import Quiz               from "./pages/Quiz";
import Dashboard          from "./pages/Dashboard";
import Locations          from "./pages/Locations";
import Hotels             from "./pages/Hotels";
import Guides             from "./pages/Guides";
import MyGuideBooking     from "./pages/MyGuideBooking";
import MyItineraries      from "./pages/MyItineraries";
import ItineraryPlanner   from "./pages/ItineraryPlanner";   // ← Member 5

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public */}
                    <Route path="/login"    element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Protected */}
                    <Route path="/quiz"                element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                    <Route path="/dashboard"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/locations"           element={<ProtectedRoute><Locations /></ProtectedRoute>} />
                    <Route path="/hotels"              element={<ProtectedRoute><Hotels /></ProtectedRoute>} />
                    <Route path="/guides"              element={<ProtectedRoute><Guides /></ProtectedRoute>} />
                    <Route path="/guides/mybooking"    element={<ProtectedRoute><MyGuideBooking /></ProtectedRoute>} />
                    <Route path="/itineraries"         element={<ProtectedRoute><MyItineraries /></ProtectedRoute>} />
                    <Route path="/itineraries/plan"    element={<ProtectedRoute><ItineraryPlanner /></ProtectedRoute>} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;