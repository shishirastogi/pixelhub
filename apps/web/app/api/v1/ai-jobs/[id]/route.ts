import { route } from "@/server/http";
import * as router from "@/server/modules/ai/router";

export const GET = route(router.getJob);
