
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppWithQueries } from '@/components/AppWithQueries';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWithQueries />
    </QueryClientProvider>
  );
}

export default App;
