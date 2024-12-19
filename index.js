#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

program
  .version('1.0.0')
  .argument('<project-name>', 'Name of the Next.js project')
  .argument('<description>', 'Description of your project and desired components')
  .option('--theme <theme>', 'Theme color scheme (default: "modern")', 'modern')
  .option('--style <style>', 'Design style (default: "minimal")', 'minimal')
  .action(async (projectName, description, options) => {
    const spinner = ora('Creating your custom Next.js application...').start();
    
    try {
      spinner.text = 'Installing Next.js application...';
      execSync(`npx create-next-app@latest ${projectName} --typescript --tailwind --eslint`, {
        stdio: 'inherit'
      });

      spinner.text = 'Analyzing project requirements...';
      const projectPlan = await analyzeProjectRequirements(description, options);

      spinner.text = 'Creating project structure...';
      await createProjectStructure(projectName, projectPlan);

      spinner.text = 'Generating components...';
      await generateComponents(projectName, projectPlan);

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

async function analyzeProjectRequirements(description, options) {
  const prompt = `
As a senior Next.js developer, analyze the following project description and create a detailed project structure.
Description: "${description}"
Theme: ${options.theme}
Style: ${options.style}

Return a raw JSON object without any markdown formatting or backticks, in exactly this format:
{
  "components": [
    {
      "name": "ComponentName",
      "type": "section/layout/feature",
      "description": "Detailed description of the component",
      "props": ["Fprop1", "prop2"],
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
}

Make sure to return only valid JSON without any additional text or explanation.`;

  const completion = await openai.chat.completions.create({
    model: "grok-2-1212",
    messages: [
      { role: "system", content: "You are an expert Next.js developer. Respond with valid JSON only." },
      { role: "user", content: prompt }
    ]
  });

  const content = completion.choices[0].message.content;
  try {
    const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse JSON:', cleanContent);
    throw new Error('Failed to parse project requirements');
  }
}

async function createProjectStructure(projectName, projectPlan) {
  const baseDir = path.join(process.cwd(), projectName);
  
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
    await fs.ensureDir(path.join(baseDir, dir));
  }

  if (projectPlan.dataStructures?.length > 0) {
    await generateTypeDefinitions(baseDir, projectPlan.dataStructures);
  }
}

async function generateComponents(projectName, projectPlan) {
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

    const componentCode = completion.choices[0].message.content;
    const componentDir = getComponentDirectory(component.type);
    const componentPath = path.join(process.cwd(), projectName, 'components', componentDir, `${component.name}.tsx`);
    
    await fs.writeFile(componentPath, componentCode);
  }
}

async function generateTypeDefinitions(baseDir, dataStructures) {
  const prompt = `
Create TypeScript type definitions for the following data structures:
${JSON.stringify(dataStructures)}

Include:
- Interfaces
- Type aliases
- Proper JSDoc comments
- Validation decorators (if needed)
- Utility types

Provide only the type definitions without any explanation.`;

  const completion = await openai.chat.completions.create({
    model: "grok-2-1212",
    messages: [
      { role: "system", content: "You are an expert TypeScript developer. Provide only the type definitions without any explanation." },
      { role: "user", content: prompt }
    ]
  });

  const typeDefinitions = completion.choices[0].message.content;
  await fs.writeFile(path.join(baseDir, 'types', 'index.ts'), typeDefinitions);
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