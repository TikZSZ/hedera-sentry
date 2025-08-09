import { Outlet } from "react-router-dom"

function App ()
{
  return (
    <>
      <div className="relative min-h-screen bg-background text-foreground">
        {/* {(!!location.pathname!.match(RegExp("dashboard*")))? <></>:<Navbar />} */}
        <Outlet />
        {
        /* 
        {!location.pathname.includes( "dashboard" ) ? (
          < footer className="flex items-center justify-center p-6 bg-gradient-to-br from-zinc-900 via-black to-zinc-800 text-white">
            <p>© {new Date().getFullYear()} Hedera Sentry AI. Built with 🧠</p>
          </footer>
        ) : 
         null
        } 
        */
        }
      </div >
    </>
  )
}

export default App