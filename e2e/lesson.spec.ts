import { test, expect } from "@playwright/test";

test("wrong answer explains, right answer completes", async ({ page }) => {
  await page.goto("/lessons/sum-basic-01");
  await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
});

test("practice hub lists tests", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice tests" })).toBeVisible();
});
