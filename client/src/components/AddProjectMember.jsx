import { useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import api from "../configs/api";
import { fetchWorkspaces } from "../features/workspaceSlice";

const AddProjectMember = ({ isDialogOpen, setIsDialogOpen }) => {
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();

    const id = searchParams.get("id");

    const currentWorkspace = useSelector(
        (state) => state.workspace?.currentWorkspace || null
    );

    const project = currentWorkspace?.projects?.find(
        (p) => p.id === id
    );

    const projectMembersEmails =
        project?.members?.map(
            (member) => member.user.email
        ) || [];

    const [email, setEmail] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!project) {
            toast.error("Project not found");
            return;
        }

        setIsAdding(true);

        try {
          await api.post(
  `/api/projects/${project.id}/members`,
  { email },
  {
    headers: {
      Authorization: `Bearer ${await getToken()}`
    }
  }
);

            toast.success("Added to project successfully");
            setIsDialogOpen(false);

            dispatch(fetchWorkspaces(getToken));

        } catch (error) {
            toast.error(
                error?.response?.data?.message || error.message
            );
        } finally {
            setIsAdding(false);
        }
    };

    if (!isDialogOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5" />
                        Add Member to Project
                    </h2>

                    {currentWorkspace && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-400">
                            Adding to Project:
                            <span className="text-blue-600 dark:text-blue-400">
                                {" "}
                                {project?.name}
                            </span>
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="email"
                            className="text-sm font-medium"
                        >
                            Email Address
                        </label>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />

                            <select
                                value={email}
                                onChange={(e) =>
                                    setEmail(e.target.value)
                                }
                                className="pl-10 mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 py-2"
                                required
                            >
                                <option value="">
                                    Select a member
                                </option>

                                {currentWorkspace?.members
                                    ?.filter(
                                        (member) =>
                                            !projectMembersEmails.includes(
                                                member.user.email
                                            )
                                    )
                                    .map((member) => (
                                        <option
                                            key={member.user.id}
                                            value={member.user.email}
                                        >
                                            {member.user.email}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() =>
                                setIsDialogOpen(false)
                            }
                            className="px-5 py-2 text-sm rounded border"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={
                                isAdding || !currentWorkspace
                            }
                            className="px-5 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
                        >
                            {isAdding
                                ? "Adding..."
                                : "Add Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProjectMember;