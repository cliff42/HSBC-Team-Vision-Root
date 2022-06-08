@echo off
cd lambdas
for /d %%D in (*) do (
cd "%%D"
npm start
cd ..
)