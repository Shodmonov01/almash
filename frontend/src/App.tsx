import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { FeedbackProvider } from "@/components/Feedback";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AppShell } from "@/components/AppShell";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import BrowsePage from "@/pages/BrowsePage";
import NewItemPage from "@/pages/NewItemPage";
import ItemPage from "@/pages/ItemPage";
import UserPage from "@/pages/UserPage";
import ProfilePage from "@/pages/ProfilePage";
import TradesPage from "@/pages/TradesPage";
import TradePage from "@/pages/TradePage";
import MatchesPage from "@/pages/MatchesPage";
import NotificationsPage from "@/pages/NotificationsPage";
import FavoritesPage from "@/pages/FavoritesPage";
import MessagesPage from "@/pages/MessagesPage";
import AdminPage from "@/pages/AdminPage";

export default function App() {
  return (
    <FeedbackProvider>
      <AuthProvider>
        <OnboardingGate>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/items/new" element={<NewItemPage />} />
              <Route path="/items/:id" element={<ItemPage />} />
              <Route path="/users/:id" element={<UserPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/trades" element={<TradesPage />} />
              <Route path="/trades/:id" element={<TradePage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </OnboardingGate>
      </AuthProvider>
    </FeedbackProvider>
  );
}
