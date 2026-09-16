import { route } from "@/server/http";
import * as router from "@/server/modules/branches/router";

export const POST = route(router.merge);
