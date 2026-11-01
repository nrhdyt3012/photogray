import { useOutletContext } from 'react-router';
import type { Branch, Profile } from '~/lib/supabase/types';

export interface AdminContext {
  profile: Profile;
  isOwner: boolean;
  branches: Branch[];
  /** Cabang yang sedang dikerjakan (kasir: cabangnya, owner: pilihan di sidebar). */
  branchId: string;
  setBranchId: (id: string) => void;
  reloadBranches: () => Promise<void>;
}

export const useAdmin = () => useOutletContext<AdminContext>();
