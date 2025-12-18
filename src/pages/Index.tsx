import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import Dashboard from './Dashboard';
import DataEntry from './DataEntry';
import Sales from './Sales';
import Prices from './Prices';
import Pumps from './Pumps';
import Reports from './Reports';
import Settings from './Settings';
import Settlements from './Settlements';
import Staff from './Staff';

const Index = () => {
  const location = useLocation();
  
  const renderPage = () => {
    switch (location.pathname) {
      // Point old data-entry route to quick entry (backward compatible)
      case '/data-entry':
      case '/upload':
        // Redirect to quick entry - the actual routing is handled by AppWithQueries
        return <Navigate to="/quick-entry" replace />;
      case '/sales':
        return <Sales />;
      case '/prices':
        return <Prices />;
      case '/pumps':
        return <Pumps />;
      case '/reports':
        return <Reports />;
      case '/settings':
        return <Settings />;
      case '/settlements':
        return <Settlements />;
      case '/staff':
        return <Staff />;
      case '/dashboard':
      case '/':
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppLayout>
      {renderPage()}
    </AppLayout>
  );
};

export default Index;
