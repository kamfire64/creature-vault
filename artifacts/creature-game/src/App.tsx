import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import InventoryPage from "@/pages/inventory";
import PacksPage from "@/pages/packs";
import MarketplacePage from "@/pages/marketplace";
import ProfilePage from "@/pages/profile";
import BattlePage from "@/pages/battle";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/inventory" />
      </Route>
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/packs" component={PacksPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/battle" component={BattlePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
