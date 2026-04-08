import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [quizCompleted, setQuizCompleted] = useState(null);

    const login = (data) => {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
        setQuizCompleted(data.quiz_completed);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setQuizCompleted(null);
    };

    return (
        <AuthContext.Provider value={{ token, quizCompleted, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};