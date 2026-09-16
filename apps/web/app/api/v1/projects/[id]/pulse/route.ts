import { route } from "@/server/http";
import * as router from "@/server/modules/projects/router";

export const GET = route(router.pulse);
