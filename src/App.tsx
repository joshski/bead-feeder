import { Link, Outlet } from 'react-router'

function App() {
  return (
    <div>
      <header>
        <h1>Bead Feeder</h1>
        <nav>
          <Link to="/">DAG View</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default App
