import NoncedleGame from './components/NoncedleGame'

const App: React.FC = () => {
  return (
    <div className="w-screen flex items-center justify-center bg-gray-100">
      <div className="w-[95vw] min-h-[95vh] overflow-y-auto">
        <NoncedleGame />
      </div>
    </div>
  )
}

export default App