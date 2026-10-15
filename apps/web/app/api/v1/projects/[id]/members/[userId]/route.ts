import { route } from "@/server/http";
import * as router from "@/server/modules/projects/router";

export const PATCH = route(router.updateMember);
export const DELETE = route(router.removeMember);
