const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const app = express();

const PORT = 8080;

app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

const getPastContestsLink = async () => {
  //https://www.codechef.com/api/list/contests/all
  try {
    const URL = "https://www.codechef.com/contests";
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(URL, {
      waitUntil: "networkidle2",
    });
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const $ = cheerio.load(bodyHTML);
    const contestLinks = [];
    $("#past-contests-data > tr").each((idx, el) => {
      if (idx > 2) return false;
      let contestCode,
        lastDay = false;
      $(el)
        .children()
        .each((childIdx, childEl) => {
          if (childIdx === 0) {
            const dd = (contestCode = $(childEl).text());
            contestCode = `https://www.codechef.com/${dd}B`;
          } else if (childIdx === 2) {
            const date = $(childEl).attr("data-starttime");
            const contestDate = new Date(date);
            const currDate = new Date();
            const currMs = currDate.getTime(),
              conMs = contestDate.getTime();
            let diff = (currMs - conMs) / (1000 * 60 * 60 * 24);
            if (diff < 3) lastDay = true;
          }
        });
      if (lastDay) {
        contestLinks.push(contestCode);
      }
    });
    await browser.close();
    return contestLinks;
  } catch (err) {
    console.log("error in getPastContestsLink = ", err);
    return [];
  }
};

const getProblemsLink = async (contestUrl) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const problemLinks = {};
    await Promise.all(
      contestUrl.map(async (url) => {
        await page.goto(url, {
          waitUntil: "networkidle2",
        });
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);
        const $ = cheerio.load(bodyHTML);
        const currProb = [];
        $("tbody:first > tr").each((idx, el) => {
          let problemCode;
          $(el)
            .children()
            .each((problemIdx, innerEl) => {
              if (problemIdx == 1) {
                problemCode = $(innerEl).text().trim();

                const req = `https://www.codechef.com/problems/${problemCode}`;
                currProb.push(req);
              }
            });
        });
        problemLinks[url.split("/").at(-1)] = currProb;
      })
    );
    await browser.close();
    return problemLinks;
  } catch (error) {
    console.log("error in getPastContestsLink = ", error);
    return [];
  }
};

app.get("/getpdf", async (req, res) => {
  try {
    // USER LOGIN
    const LOGIN_URL = "https://www.codechef.com/login";
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(LOGIN_URL, {
      waitUntil: "networkidle2",
    });
    const USER_NAME = process.env.USER_NAME, PASSWORD = process.env.PASSWORD;
    await page.evaluate(
      (USER_NAME, PASSWORD) => {
        document.getElementById("edit-name").setAttribute("value", USER_NAME);
        document.getElementById("edit-pass").setAttribute("value", PASSWORD);
      },
      USER_NAME,
      PASSWORD
    );
    await page.evaluate(() => {
      document.querySelector("input[type=submit]").click();
    });
    const cookies = await page.cookies();
    await page.close();
    const page2 = await browser.newPage();
    await page2.setCookie(...cookies);
    const contestLinks = await getPastContestsLink();
    // console.log(contestLinks);
    const problemLinks = await getProblemsLink(contestLinks);
    console.log(problemLinks);
    // series
    for (const contest in problemLinks) {
      // const rr = path('')
      let isError = false;
      fs.mkdir(`./${contest}`, (error) => {
        if (error) {
          console.log(error);
          isError = true;
        } else {
          console.log(`${contest} Directory created successfully !!`);
        }
      });
      if(isError) continue;
      for (url of problemLinks[contest]) {
        await page2.goto(url + "?tab=solution", {
          waitUntil: "networkidle0",
        });
        await page2.screenshot({
          path: `${contest}/${url.split("/").at(-1)}.png`,
        });
      }
    }
    // parellel
    // await Promise.all(problemLinks.map(async (url) => {
    //     console.log("uu = ", url);
    //   await page2.goto(url + '?tab=solution', {
    //     waitUntil: "networkidle0",
    //   });
    //   await page2.screenshot({ path: `${url.split('/').at(-1)}.png` });
    // }));
    await browser.close();
    res.redirect("/");
  } catch (err) {
    console.log("Error in getpdf = ", err);
    res.send("error in getpdf");
  }
});

app.listen(PORT, () => {
  console.log(`Listening on PORT = ${PORT}`);
});
