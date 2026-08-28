/**
 * The proposal's `square` and `trafficLight` definitions as the converter of
 * this workspace generates them from the fixtures' `.mmd` text, stored as
 * vitest file snapshots: the `*.generated.ts` files next to this test are
 * what `vizMachine.types.test.tsx` typechecks against `VizMachine`. When the
 * converter's output changes, `vitest -u` regenerates them (they are excluded
 * from prettier, see `.prettierignore`).
 */
import { convert } from "@fozy-labs/statechart-converter";
import { describe, expect, it } from "vitest";

import { squareFixture, trafficLightFixture } from "../../testing/fixtures";

describe.each([squareFixture, trafficLightFixture])("$name.generated.ts", (fixture) => {
    it("is the converter's output for the fixture's source", async () => {
        const { code } = convert(fixture.source, { fileName: `${fixture.name}.mmd` });
        await expect(code).toMatchFileSnapshot(`./${fixture.name}.generated.ts`);
    });
});
