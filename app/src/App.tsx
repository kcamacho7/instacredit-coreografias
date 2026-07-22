function App() {
  return (
    <div className="loading-screen">
      <img className="prestamito" src={`${import.meta.env.BASE_URL}assets/prestamito_caminando.png`} alt="Cargando" />
      <div className="loading-spinner" />
      <div className="loading-text">Coreografías Operativas — en construcción</div>
    </div>
  )
}

export default App
