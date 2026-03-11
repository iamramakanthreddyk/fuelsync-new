
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FuelPricesProvider } from './context/FuelPricesContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { AppWithQueries } from '@/components/AppWithQueries';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { PWAInstallGuide } from '@/components/PWAInstallGuide';
import { PWAUpdateNotification } from '@/components/PWAUpdateNotification';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalFilterProvider>
        <FuelPricesProvider>
          <AppWithQueries />
          <PWAInstallGuide />
          <PWAInstallPrompt />
          <PWAUpdateNotification />
        </FuelPricesProvider>
      </GlobalFilterProvider>
    </QueryClientProvider>
  );
}

export default App;
