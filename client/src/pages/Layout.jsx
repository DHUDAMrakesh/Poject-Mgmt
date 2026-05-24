import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import {useUser,SignIn,useAuth, CreateOrganization} from '@clerk/clerk-react'
import { fetchWorkspaces } from '../features/workspaceSlice'
const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { loading,workspaces, initialized } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const {getToken} = useAuth()
   
    
const { user,isLoaded } = useUser()
    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [])
// Initial load of workspace, then keep checking while Clerk finishes org sync.
useEffect(()=>{
    if(isLoaded && user && workspaces.length===0){
        dispatch(fetchWorkspaces({getToken}))
        const intervalId = setInterval(() => {
            dispatch(fetchWorkspaces({getToken}))
        }, 2000)

        return () => clearInterval(intervalId)
    }
},[dispatch, getToken, user, isLoaded, workspaces.length])

if(!user){
    return(
        <div className='flex justify-center items-center h-screen bg-white dark:bg-zinc-950'>
<SignIn />
        </div>
    )
}
    if (!initialized) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )

    if(user && initialized && workspaces.length===0){
        return(
            <div className='min-h-screen flex flex-col items-center justify-center '>
<CreateOrganization afterCreateOrganizationUrl="/" />
            </div>
        )
    }

    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}

export default Layout
