import { GameProvider } from './context/GameContext';
import { MainLayout } from './components/Layout/MainLayout';

function App() {
    return (
        <GameProvider>
            <MainLayout />
        </GameProvider>
    )
}

export default App
