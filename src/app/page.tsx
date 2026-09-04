import Dashboard from "./components/Dashboard";
import { I18nProvider } from "./i18n/I18nContext";

export default function Home() {
  return (
    <I18nProvider>
      <Dashboard />
    </I18nProvider>
  );
}
