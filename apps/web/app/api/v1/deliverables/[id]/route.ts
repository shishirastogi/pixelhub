import { route } from "@/server/http";
import * as router from "@/server/modules/requirements/router";

export const PATCH = route(router.updateDeliverable);
