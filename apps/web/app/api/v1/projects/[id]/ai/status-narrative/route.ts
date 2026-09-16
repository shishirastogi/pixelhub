import { route } from "@/server/http";
import * as router from "@/server/modules/ai/router";

export const POST = route(router.statusNarrative);
