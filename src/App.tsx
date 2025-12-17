
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FuelPricesProvider } from './context/FuelPricesContext';
import { AppWithQueries } from '@/components/AppWithQueries';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FuelPricesProvider>
        <AppWithQueries />
      </FuelPricesProvider>
    </QueryClientProvider>
  );
}

export default App;
