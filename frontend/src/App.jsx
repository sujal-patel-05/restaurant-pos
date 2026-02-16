import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POSTerminal from './pages/POSTerminal';
import KDS from './pages/KDS';
import MenuManagement from './pages/MenuManagement';
import InventoryDashboard from './pages/InventoryDashboard';
import BillingInterface from './pages/BillingInterface';
import ReportsDashboard from './pages/ReportsDashboard';
import AskAI from './pages/AskAI';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POSTerminal />} />
                <Route path="/kds" element={<KDS />} />
                <Route path="/menu" element={<MenuManagement />} />
                <Route path="/inventory" element={<InventoryDashboard />} />
                <Route path="/billing" element={<BillingInterface />} />
                <Route path="/reports" element={<ReportsDashboard />} />
                <Route path="/ask-ai" element={<AskAI />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

