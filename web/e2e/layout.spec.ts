import {test,expect} from '@playwright/test';
for(const width of [360,768,1280,1920]) test('Navigáció és képernyőszélesség '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{email:'test@example.test',propertyId:1,propertyName:'Tesztlakás',readingDay:1}}));
 await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Áttekintés',exact:true})).toBeVisible();
 if(width<=800) await page.getByLabel('Menü megnyitása').click();
 await page.getByRole('link',{name:'Előzmények'}).click();
 await expect(page.getByRole('heading',{name:'Előzmények',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

