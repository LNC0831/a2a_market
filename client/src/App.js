import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Hall from './pages/Hall';
import PostTask from './pages/PostTask';
import TaskDetail from './pages/TaskDetail';
import Login from './pages/Login';
import Me from './pages/Me';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/hall" element={<Hall />} />
          <Route path="/post" element={<PostTask />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/me" element={<Me />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
