import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login           from "./pages/Login";
import Register        from "./pages/Register";
import Quiz            from "./pages/Quiz";
import Dashboard       from "./pages/Dashboard";
import Locations       from "./pages/Locations";
import Hotels          from "./pages/Hotels";
import Guides          from "./pages/Guides";           // ← Member 4b
import MyGuideBooking  from "./pages/MyGuideBooking";   // ← Member 4b
import MyItineraries   from "./pages/MyItineraries";

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login"    element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/quiz"          element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                    <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/locations"     element={<ProtectedRoute><Locations /></ProtectedRoute>} />
                    <Route path="/hotels"        element={<ProtectedRoute><Hotels /></ProtectedRoute>} />
                    <Route path="/guides"        element={<ProtectedRoute><Guides /></ProtectedRoute>} />
                    <Route path="/guides/mybooking" element={<ProtectedRoute><MyGuideBooking /></ProtectedRoute>} />
                    <Route path="/itineraries"   element={<ProtectedRoute><MyItineraries /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;