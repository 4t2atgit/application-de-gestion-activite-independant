import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Clients } from './pages/Clients';
import { Dashboard } from './pages/Dashboard';
import { Factures } from './pages/Factures';
import { Frais } from './pages/Frais';
import { Heures } from './pages/Heures';
import { Projets } from './pages/Projets';
import { Corbeille } from './pages/Corbeille';
import { Parametrages } from './pages/Parametrages';
import { Aide } from './pages/Aide';

function App() {
  return (
    <div className="min-h-screen bg-app text-body">
      <div className="flex min-h-screen w-full flex-col gap-6 px-4 py-6">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/projets" element={<Projets />} />
            <Route path="/heures" element={<Heures />} />
            <Route path="/factures" element={<Factures />} />
            <Route path="/frais" element={<Frais />} />
            <Route path="/corbeille" element={<Corbeille />} />
            <Route path="/parametrages" element={<Parametrages />} />
            <Route path="/aide" element={<Aide />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
