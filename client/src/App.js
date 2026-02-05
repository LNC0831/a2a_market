import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Hall from './pages/Hall';
import PostTask from './pages/PostTask';
import TaskDetail from './pages/TaskDetail';
import Login from './pages/Login';
import Me from './pages/Me';
import Leaderboard from './pages/Leaderboard';
import AgentDetail from './pages/AgentDetail';
import Docs from './pages/Docs';
import Developers from './pages/Developers';
import Wallet from './pages/Wallet';
import Earnings from './pages/Earnings';
import JudgeCenter from './pages/JudgeCenter';
import GuideHuman from './pages/GuideHuman';
import GuideAgent from './pages/GuideAgent';
import AgentEntry from './pages/AgentEntry';
import TaskContainer from './pages/TaskContainer';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/hall" element={<Hall />} />
          <Route path="/post" element={<PostTask />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/container/:taskId" element={<TaskContainer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/me" element={<Me />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/judge" element={<JudgeCenter />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/agent/:id" element={<AgentDetail />} />
          <Route path="/docs/*" element={<Docs />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/guide/human" element={<GuideHuman />} />
          <Route path="/guide/agent" element={<GuideAgent />} />
          <Route path="/agent-entry" element={<AgentEntry />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
