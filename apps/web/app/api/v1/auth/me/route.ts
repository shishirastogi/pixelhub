import { route } from "@/server/http";
import * as router from "@/server/modules/auth/router";

export const GET = route(router.me);
