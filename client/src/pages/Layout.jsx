import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import {useUser,SignIn,useAuth, CreateOrganization, useOrganizationList} from '@clerk/clerk-react'
import { fetchWorkspaces } from '../features/workspaceSlice'
import { API_BASE_URL } from '../configs/api'
const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { workspaces, initialized } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const {getToken} = useAuth()
    const syncEndpointMissing = useRef(false)
   
    
const { user,isLoaded } = useUser()
    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [dispatch])
// Initial load of workspace, then keep checking while Clerk finishes org sync.
const { userMemberships, isLoaded: isOrganizationListLoaded } = useOrganizationList({ userMemberships: true });
const organizations = useMemo(
    () => userMemberships?.data?.map((membership) => membership.organization) || [],
    [userMemberships?.data],
);

const syncAndLoadWorkspaces = useCallback(async () => {
    try {
        if (isOrganizationListLoaded && organizations.length > 0 && !syncEndpointMissing.current) {
            const response = await fetch(`${API_BASE_URL}/api/workspaces/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({
                    organizations,
                    user: {
                        id: user?.id,
                        name: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress,
                        email: user?.primaryEmailAddress?.emailAddress,
                        image: user?.imageUrl,
                    },
                }),
            });
            if (response.status === 404) {
                syncEndpointMissing.current = true;
            }
        }
    } catch (e) {
        console.log('Workspace sync failed:', e.message || e);
    }

    dispatch(fetchWorkspaces({getToken}));
}, [dispatch, getToken, isOrganizationListLoaded, organizations, user]);

useEffect(()=>{
    let intervalId;

    if(isLoaded && user && workspaces.length===0){
        syncAndLoadWorkspaces();
        intervalId = setInterval(() => {
            syncAndLoadWorkspaces();
        }, 2000)

        return () => clearInterval(intervalId)
    }
},[isLoaded, user, workspaces.length, syncAndLoadWorkspaces])

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
