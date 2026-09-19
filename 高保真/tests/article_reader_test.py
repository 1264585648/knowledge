"""DOM smoke tests for the static preview; no network or app login required.
Run: python 高保真/tests/article_reader_test.py
Requires playwright and a Chromium browser. Set CHROMIUM_PATH if necessary.
Storage is explicitly mocked on about:blank; this tests serialization/restoration,
not real-origin persistence, Astro compilation, or Worker authentication.
"""
from pathlib import Path
import os
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
markup = (ROOT / '高保真/article.html').read_text()
markup = markup.replace('<link rel="stylesheet" href="../site/public/public/article-reader.css">', '<style>' + (ROOT / 'site/public/public/article-reader.css').read_text() + '</style>')
markup = markup.replace('<script src="../site/public/public/article-reader.js" defer></script>', '<script>' + (ROOT / 'site/public/public/article-reader.js').read_text() + '</script>')
errors = []
results = []

def check(condition, label):
    assert condition, label
    results.append(label)

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    def new_page(storage=None, width=1440, height=1000, mock=True):
        page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce', accept_downloads=True)
        page.on('pageerror', lambda e: errors.append(str(e)))
        if mock:
            page.evaluate('''(initial) => {
              const data = {...initial};
              window.__testStorage = data;
              Object.defineProperty(window, 'localStorage', { configurable:true, value: {
                getItem(k) { return Object.hasOwn(data,k) ? data[k] : null; },
                setItem(k,v) { data[k] = String(v); },
                removeItem(k) { delete data[k]; }
              }});
            }''', storage or {})
        page.set_content(markup, wait_until='load')
        return page

    page = new_page()
    check(page.locator('h1').count() == 1, 'single article heading')
    check(page.locator('.reader-content h2').count() == 3, 'three required RAG sections')
    check(page.locator('.outline-nav a').count() == 11, 'nested outline generated')
    check(page.locator('.outline-nav a').evaluate_all('(links)=>links.every(a=>document.getElementById(decodeURIComponent(a.hash.slice(1))))'), 'all outline targets exist')
    page.locator('#tab-ask').focus(); page.keyboard.press('ArrowRight')
    check(page.locator('#tab-comments').get_attribute('aria-selected') == 'true', 'keyboard tab switching')
    page.keyboard.press('End')
    check(page.locator('#panel-notes').is_visible(), 'End key selects notes')
    page.locator('#tab-ask').click()
    page.locator('[data-question]').first.click()
    check(bool(page.locator('#question-input').input_value()), 'suggested question fills input')
    page.locator('#question-form button[type=submit]').click()
    check('原文摘录' in page.locator('#question-log').inner_text(), 'question explicitly displays demo excerpt')
    check(page.locator('#question-log .reader-entry').count() == 2, 'one question and one excerpt')
    page.locator('#tab-comments').click()
    page.locator('#comment-input').fill('<img src=x onerror=alert(1)> 这是演示评论')
    page.locator('#comment-form button[type=submit]').click()
    check(page.locator('#comment-list .reader-entry').count() == 1, 'comment added locally')
    check(page.locator('#comment-list img').count() == 0, 'comment input rendered as text, not HTML')
    page.locator('#comment-list button').click()
    check(page.locator('#comment-empty').is_visible(), 'comment deletion restores empty state')
    page.locator('#tab-notes').click()
    page.locator('#note-input').fill('RAG 的关键是先找到本次回答所需的资料。')
    page.locator('#save-note').click()
    check('1 条' == page.locator('#note-count').inner_text(), 'note saved')
    state = page.evaluate('window.__testStorage')
    restored = new_page(storage=state)
    restored.locator('#tab-notes').click()
    check('RAG 的关键' in restored.locator('#note-list').inner_text(), 'serialized notes restored by a new reader instance')
    restored.locator('#note-list button', has_text='编辑').click()
    restored.locator('#note-input').fill('更新后的笔记')
    restored.locator('#save-note').click()
    check('更新后的笔记' in restored.locator('#note-list').inner_text(), 'note editing')
    with restored.expect_download() as download_info:
        restored.locator('#export-notes').click()
    check(download_info.value.suggested_filename.endswith('.md'), 'Markdown export')
    restored.on('dialog', lambda dialog: dialog.accept())
    restored.locator('#note-list button', has_text='删除').click()
    check(restored.locator('#note-empty').is_visible(), 'note deletion')
    restored.close()

    page.evaluate('window.scrollTo(0,0)')
    page.evaluate('''() => {
      const p=document.querySelector('#reader-content > p');
      const range=document.createRange();range.selectNodeContents(p);
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      p.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    }''')
    page.wait_for_timeout(60)
    check(page.locator('.selection-actions').is_visible(), 'text selection opens contextual toolbar')
    page.locator('[data-selection-note]').click()
    check(page.locator('#note-quote').is_visible(), 'selection copied to note quote')
    page.locator('#note-input').fill('围绕原文的想法')
    page.locator('#save-note').click()
    check(page.locator('#note-list blockquote').count() == 1, 'quoted note stored with source')
    page.locator('[data-focus]').click()
    check(page.locator('.reader-tools').is_hidden(), 'focus mode hides right tools')
    page.locator('[data-focus]').click()
    check(page.locator('.reader-tools').is_visible(), 'focus mode exits')

    for width in [1440,1280,1101,1024,768,760,390,320]:
        page.set_viewport_size({'width':width,'height':1000})
        check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'no horizontal overflow at {width}px')
    page.locator('.tools-launcher').click()
    check(page.locator('.reader-tools').get_attribute('aria-modal') == 'true', 'mobile tools are a modal dialog')
    check(page.locator('.reader-article').evaluate('(e)=>e.inert'), 'mobile background is inert')
    page.keyboard.press('Escape')
    check(page.locator('.reader-tools').is_hidden(), 'Escape closes mobile tools')
    check(page.locator('.tools-launcher').evaluate('(e)=>e===document.activeElement'), 'focus returns to mobile launcher')
    page.locator('.tools-launcher').click()
    page.set_viewport_size({'width':1440,'height':1000})
    check(page.evaluate('document.body.style.overflow !== "hidden"'), 'resizing drawer restores scroll')
    check(not page.locator('.reader-article').evaluate('(e)=>e.inert'), 'resizing drawer restores background access')
    page.close()

    blocked = new_page(mock=False)
    blocked.locator('#tab-notes').click()
    check(blocked.locator('#storage-warning').is_visible(), 'unavailable storage is clearly reported')
    blocked.locator('#note-input').fill('临时保留')
    blocked.locator('#save-note').click()
    check('仅本页暂存' in blocked.locator('#note-state').inner_text(), 'failed persistence is not reported as saved')
    blocked.close()
    corrupt = new_page(storage={'zhiye:reader-notes:v1:what-is-rag':'not-json'})
    corrupt.locator('#tab-notes').click()
    check(corrupt.locator('#storage-warning').is_visible(), 'malformed stored data handled')
    corrupt.close()
    check(not errors, 'no JavaScript page errors: '+str(errors))
    browser.close()
print(f'PASS: {len(results)} checks')
for result in results: print('  ✓',result)
