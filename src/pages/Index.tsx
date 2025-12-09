import React from 'react';
import { useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { FuelPricesProvider } from '../context/FuelPricesContext';
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
      // Point old and new routes to DataEntry (backward compatible)
      case '/data-entry':
      case '/upload':
        return <DataEntry />;
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
      case '/daily-closure':
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
    <FuelPricesProvider>
      <AppLayout>
        {renderPage()}
      </AppLayout>
    </FuelPricesProvider>
  );
};

export default Index;
