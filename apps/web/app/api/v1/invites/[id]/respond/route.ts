import { route } from "@/server/http";
import * as router from "@/server/modules/projects/router";

export const POST = route(router.respondInvite);
