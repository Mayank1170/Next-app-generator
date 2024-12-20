#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

const currentDir = process.cwd();

program
  .version('1.0.0')
  .argument('<project-name>', 'Name of the Next.js project')
  .argument('<description>', 'Description of your project and desired components')
  .requiredOption('--api-key <key>', 'Your X.AI API key') 
  .option('--theme <theme>', 'Theme color scheme (default: "modern")', 'modern')
  .option('--style <style>', 'Design style (default: "minimal")', 'minimal')
  .action(async (projectName, description, options) => {
    const spinner = ora('Creating your custom Next.js application...').start();
    
    try {
      const openai = new OpenAI({
        apiKey: options.apiKey,  
        baseURL: "https://api.x.ai/v1"
      });

      const projectPath = path.join(currentDir, projectName);
      
      if (fs.existsSync(projectPath)) {
        throw new Error(`Directory ${projectName} already exists. Please choose a different name or delete the existing directory.`);
      }

      spinner.text = 'Installing Next.js application...';
      execSync(`npx create-next-app@latest ${projectName} --typescript --tailwind --eslint`, {
        stdio: 'inherit',
        cwd: currentDir
      });

      spinner.text = 'Analyzing project requirements...';
      const projectPlan = await analyzeProject(description, options, openai);

      spinner.text = 'Creating project structure...';
      await createProjectStructure(projectPath, projectPlan);

      spinner.text = 'Generating components...';
      await generateComponents(projectPath, projectPlan, openai);

      spinner.succeed(chalk.green('🚀 Your custom Next.js application is ready!'));
      
      console.log('\nNext steps:');
      console.log(chalk.cyan(`  cd ${projectName}`));
      console.log(chalk.cyan('  npm run dev\n'));
      
    } catch (error) {
      spinner.fail(chalk.red('Error creating project: ' + error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);

async function analyzeProject(description, options, openai) {
  const prompt = `
Analyze this Next.js project and return a JSON object. The response should be a raw JSON object without any markdown formatting, backticks, or explanation.

Project details:
Description: "${description}"
Theme: ${options.theme}
Style: ${options.style}

Return this exact JSON structure (fill in appropriate values):
{
  "components": [
    {
      "name": "ComponentName",
      "type": "section/layout/feature",
      "description": "Detailed description of the component",
      "props": ["prop1", "prop2"],
      "dependencies": ["dep1", "dep2"]
    }
  ],
  "pages": [
    {
      "name": "PageName",
      "route": "/route",
      "components": ["ComponentName1", "ComponentName2"]
    }
  ],
  "features": ["feature1", "feature2"],
  "dataStructures": ["type1", "type2"]
}`;

  const completion = await openai.chat.completions.create({
    model: "grok-2-1212",
    messages: [
      { role: "system", content: "You are an expert Next.js developer. Return a JSON object without any backticks, markdown formatting, or explanation." },
      { role: "user", content: prompt }
    ],
    temperature: 0
  });

  const content = completion.choices[0].message.content;
  let cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
  
  try {
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse JSON:', cleanContent);
    throw new Error(`Failed to parse project requirements: ${error.message}`);
  }
}

async function createProjectStructure(projectPath, projectPlan) {
  const directories = [
    'components',
    'components/ui',
    'components/sections',
    'components/layout',
    'components/features',
    'lib',
    'types',
    'hooks',
    'styles',
    'public/images'
  ];

  for (const dir of directories) {
    await fs.ensureDir(path.join(projectPath, dir));
  }
}

async function generateComponents(projectPath, projectPlan, openai) {
  for (const component of projectPlan.components) {
    const prompt = `
Create a modern, responsive Next.js component with the following specifications:
Name: ${component.name}
Type: ${component.type}
Description: ${component.description}
Props: ${JSON.stringify(component.props)}

Requirements:
- Use TypeScript
- Use Tailwind CSS for styling
- Include proper error handling and loading states
- Add JSDoc comments
- Follow React best practices
- Make it responsive for mobile, tablet, and desktop
- Include proper accessibility attributes

Provide only the component code without any explanation.`;

    const completion = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: "You are an expert Next.js developer. Provide only the component code without any explanation." },
        { role: "user", content: prompt }
      ]
    });

    const componentCode = completion.choices[0].message.content.replace(/```tsx?\n?|```\n?/g, '').trim();
    const componentDir = getComponentDirectory(component.type);
    const componentPath = path.join(projectPath, 'components', componentDir, `${component.name}.tsx`);
    
    await fs.writeFile(componentPath, componentCode);
  }
}

function getComponentDirectory(type) {
  const typeToDir = {
    'section': 'sections',
    'layout': 'layout',
    'feature': 'features',
    'ui': 'ui'
  };
  return typeToDir[type] || '';
}